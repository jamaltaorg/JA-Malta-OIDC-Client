import {JAMaltaIssuer, IssuerOptions} from "./Issuer";
import {authenticate, callbackMiddleware, logoutMiddleware} from "./Middleware";

declare global {
    namespace Express {
        interface Request {
            tokenCode: string;
            jaUserInfo : UserInfo;
        }
    }
}

interface UserInfo {
    sub: string;
    name?: string;
    description?: string;
    birthdate?: string,
    birthdateTimestamp?: string,
    group?: string,
    type?: string,
    email?: string
}

export {UserInfo, JAMaltaIssuer, IssuerOptions, authenticate, callbackMiddleware, logoutMiddleware}