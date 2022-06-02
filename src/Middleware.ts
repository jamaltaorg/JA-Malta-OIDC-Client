import {NextFunction, Request, Response} from "express";
import {JAMaltaIssuer} from "./Issuer";

/**
 * Callback Middleware is the function that will handle the token verification during the callback.
 * This will also set the cookie with the Bearer token (aka code).
 *
 * @param issuer The initialised JA Malta Issuer
 * @param useRedirect If the redirection cookie will be used.
 * @param uri Which uri to use. @see {@link JAMaltaIssuer.verifyToken}.
 */
export const callbackMiddleware = (issuer: JAMaltaIssuer, useRedirect: boolean, uri?: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        let token = issuer.verifyToken(req, uri).then(value => {
            if (value === undefined) res.status(401);
            else {
                //This means that the authorisation token has been set
                res.status(200);
                setAuthCookie(res, value.access_token, value.expires_at)

                if(req.cookies["before-callback-location"]){ //If there is a before callback location, go back to where the trigger was made
                    let redirect = req.cookies["before-callback-location"];
                    res.clearCookie("before-callback-location");
                    if(useRedirect) return res.redirect(redirect);
                }
                //This means that the authorisation token has been set
            }

            next();
        });
    }
}

/**
 * Authentication Middleware is the function called when one wants to make sure that the user is properly authenticated.  If the user is not authenticated, they will be redirected to the login page.  Once the login is complete, the user continues where they left off.
 *
 * This also sets req information such as jaUserInfo and tokenCode for future usage if needed.
 * @param issuer
 */
export const authenticate = (issuer: JAMaltaIssuer) => {
    return (req: Request, res: Response, next: NextFunction) => {
        let token = req.cookies["Authorization"]?.split(" ")[1] ?? req.header("Authorization")?.split(" ")[1]; //Try getting the token from the cookies or header

        issuer.getToken(token).then(async (value) => {
            if(!value) {
                setCallbackRedirectCookie(res, req.originalUrl);
                return res.redirect(await issuer.authorisationUrl); //If the value is undefined, redirect the user to the login page
            }

            if(value.access_token !== token) setAuthCookie(res, value.access_token, value.expires_at); //If there was a refresh token, update the cookie with the new refresh token
            req.tokenCode = value.access_token;
            req.jaUserInfo = await issuer.getUserInfo(value); //Get the user info and cache it into the request

            res.status(200);
            next();
        });
    }
}

export const logoutMiddleware = (issuer: JAMaltaIssuer) => {
    return (req: Request, res: Response, next: NextFunction) => {
        res.clearCookie("Authorization");
        res.clearCookie("before-callback-location");

        issuer.removeFromCache(req.tokenCode);
        next();
    }
}

function setCallbackRedirectCookie(res: Response, currentEndpoint: string){
    res.cookie("before-callback-location", currentEndpoint, {httpOnly: true})
}

function setAuthCookie(res: Response, accessToken: string, expires: number){
    let date = new Date(expires * 1000);
    res.cookie("Authorization", `Bearer ${accessToken}`, {httpOnly: true, expires: date});
}