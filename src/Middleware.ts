import {NextFunction, Request, Response} from "express";
import {JAMaltaIssuer} from "./Issuer";

/**
 * Callback Middleware is the function that will handle the token verification during the callback.
 * This will also set the cookie with the Bearer token (aka code).
 *
 * @param issuer The initialised JA Malta Issuer
 */
export const callbackMiddleware = (issuer: JAMaltaIssuer) => {
    return (req: Request, res: Response, next: NextFunction) => {
        let token = issuer.verifyToken(req).then(value => {
            if (value === undefined) res.status(401);
            else {
                //This means that the authorisation token has been set
                res.status(200);
                setAuthCookie(res, value.access_token)
                //This means that the authorisation token has been set
            }

            next();
        });
    }
}

export const authenticate = (issuer: JAMaltaIssuer) => {
    return (req: Request, res: Response, next: NextFunction) => {
        let token = req.cookies["Authorization"]?.split(" ")[1] ?? req.header("Authorization")?.split(" ")[1]; //Try getting the token from the cookies or header

        issuer.getToken(token).then(async (value) => {
            if(!value) return res.redirect(await issuer.authorisationUrl); //If the value is undefined, redirect the user to the login page

            if(value.access_token !== token) setAuthCookie(res, value.access_token); //If there was a refresh token, update the cookie with the new refresh token
            req.jaUserInfo = await issuer.getUserInfo(value); //Get the user info and cache it into the request

            res.status(200);
        });
    }
}

function setAuthCookie(res: Response, accessToken: string){
    res.cookie("Authorization", `Bearer ${accessToken}`, {httpOnly: true});
}