import {JAMaltaIssuer, IssuerOptions} from "./Issuer";
import {authenticate, callbackMiddleware} from "./Middleware";

declare global {
    namespace Express {
        interface Request {
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

export {UserInfo, JAMaltaIssuer, IssuerOptions, authenticate, callbackMiddleware}

let issuer = new JAMaltaIssuer("Xa0b2QCj1nnfH29TmIpZDvyAvVHrazK1", "fvBHN8GmeV4rPRPznxi5ESbkrp7B7K4H", [""], ["code"], ["openid", "email"])

