import crypto from "node:crypto";
import dotenv from "dotenv";
import nock from "nock";

dotenv.config();

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
const ISSUER = `https://${AUTH0_DOMAIN}/`;
const KID = "test-signing-key";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, use: "sig", alg: "RS256" };

// Intercepts the OIDC discovery + JWKS calls express-oauth2-jwt-bearer makes against the
// real Auth0 domain, and serves a JWKS for a keypair we generated locally — so tests can
// sign their own tokens without ever talking to the real Auth0 tenant.
export const mockAuth0 = () => {
    nock(`https://${AUTH0_DOMAIN}`)
        .persist()
        .get("/.well-known/openid-configuration")
        .reply(200, {
            issuer: ISSUER,
            jwks_uri: `${ISSUER}.well-known/jwks.json`,
        })
        .get("/.well-known/jwks.json")
        .reply(200, { keys: [jwk] });
};

const base64url = (input) => Buffer.from(input).toString("base64url");

// Signs a fake-but-valid Auth0 access token for `sub` using our locally generated key,
// verifiable by anyone trusting the mocked JWKS above.
export const signAccessToken = (sub, { audience = AUTH0_AUDIENCE, expiresInSeconds = 3600 } = {}) => {
    const header = { alg: "RS256", typ: "JWT", kid: KID };
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: ISSUER, sub, aud: audience, iat: now, exp: now + expiresInSeconds };
    const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = crypto.sign("RSA-SHA256", Buffer.from(data), privateKey);
    return `${data}.${base64url(signature)}`;
};

export const bearer = (sub, opts) => `Bearer ${signAccessToken(sub, opts)}`;
