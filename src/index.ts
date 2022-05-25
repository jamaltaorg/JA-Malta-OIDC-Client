import {JAMaltaIssuer} from "./Issuer";
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
    name: string;
    description: string;
    birthdate: string,
    birthdateTimestamp: string,
    group: string,
    type: string,
    email: string
}

export {UserInfo, JAMaltaIssuer, authenticate, callbackMiddleware}



