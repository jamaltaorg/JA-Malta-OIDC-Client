import {Client, generators, Issuer, TokenSet, UserinfoResponse} from "openid-client";
import {Request} from "express";
import {debug} from "util";
import {UserInfo} from "./index";

export class JAMaltaIssuer{
    private readonly issuerUrl : string;
    private _client: Client;
    private _issuer: Issuer;

    clientId: string;
    clientSecret: string;
    redirectUris: string[];
    responseTypes: string[];
    scope: string;

    private readonly codeVerifier;
    private readonly codeChallenge;

    private tokenStore : Map<string, TokenSet>;

    private readonly userCache: Map<string, UserCache>;
    private readonly cacheTTL : number;
    /**
     * Constructs the Issuer Module
     * @param clientId Client ID
     * @param clientSecret Client Secret
     * @param redirectUris The redirect uris
     * @param responseTypes Response types such as code, id_token, etc
     * @param scopes Required scopes.  The array is then converted into a string seperated by spaces
     * @param options Optional options for client.  @see{@link IssuerOptions}.
     */
    constructor(clientId: string, clientSecret: string, redirectUris: string[], responseTypes: string[], scopes: string[], options?: IssuerOptions) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUris = redirectUris;
        this.responseTypes = responseTypes;
        this.scope = scopes.join(" ");

        this.codeVerifier = generators.codeVerifier();
        this.codeChallenge = generators.codeChallenge(this.codeVerifier);

        this.issuerUrl = process.env["CUSTOM_ISSUER_URL"] ?? "https://auth,jayemalta.org/"

        console.log(options.cacheEnabled);
        this.tokenStore = new Map<string, TokenSet>();
        if(options.cacheEnabled ?? true) this.userCache = new Map<string, UserCache>();
        this.cacheTTL = options.cacheTTL ?? 3600;
    }

    /**
     * Auto-discover the issuer.  Assumes OIDC Standards are met
     * @private
     */
    private get issuer() : Promise<Issuer>{
        return new Promise<Issuer>(async (resolve) => {
            if(this._issuer)
                resolve(this._issuer)
            else {
                this._issuer = await Issuer.discover(this.issuerUrl);
                resolve(this._issuer);
            }
        });
    }

    /**
     * Get the client which will handle all the coming requests
     */
    get client() : Promise<Client>{
        return new Promise<Client>(async (resolve) => {
            if(this._client) return resolve(this._client);

            let issuer = await this.issuer;
            this._client = new issuer.Client({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uris: this.redirectUris,
                response_types: this.responseTypes
            });

            return resolve(this._client);
        })
    }

    /**
     * Get the authorisation url based on the code challenge
     */
    get authorisationUrl() : Promise<string> {
        return new Promise<string>(async (resolve) => {
            let client = await this.client;
            return resolve(client.authorizationUrl({
                scope: this.scope,
                code_challenge: this.codeChallenge,
                code_challenge_method: "S256"
            }));
        });
    }

    /**
     *
     * @param code
     */
    public getLogoutUrl(code: string): Promise<string>{
        return new Promise<string>(async resolve => {
            let client = await this.client;
            let token = await this.getToken(code);

            resolve (client.endSessionUrl({id_token_hint: token?.id_token ?? undefined}));
        })
    }

    /**
     * Verify the token received from the callback
     * @param req The request from express
     * @param uri In the case that multiple redirectUris are passed, it will either default to the first uri or the given, second uri @see {@link redirectUris}
     */
    async verifyToken(req: Request, uri? : number) : Promise<TokenSet | undefined>{
        let client = await this.client;
        const params = client.callbackParams(req);

        try {
            let verify = await client.callback(this.redirectUris[uri ?? 0], params, {code_verifier: this.codeVerifier});
            this.storeToken = verify;
            return verify;
        }catch (error){
            debug("There was an error with the verification");
            debug(error);
            return undefined;
        }
    }

    /**
     * Store the token from Provider and the TokenSet information
     * @param token
     */
    private set storeToken(token: TokenSet){
        this.tokenStore.set(token.access_token, token);
    }

    /**
     * Gets the token set based on the token given by the user
     *
     * At this point, if undefined is returned, get the authorisation url @see {@link authorisationUrl} and redirect the user back to the login page.
     * @param token
     */
    public async getToken(token: string) : Promise<TokenSet | undefined>{
        let tokenSet = this.tokenStore.get(token);

        if(!tokenSet.expired()) return tokenSet;
        else if(tokenSet.expired() && !tokenSet.refresh_token) return undefined;
        else if(tokenSet.expired() && tokenSet.refresh_token){
            let client = await this.client;
            try {
                this.storeToken = await client.refresh(tokenSet.refresh_token);
            }catch (error){
                debug("There was an error with the verification");
                debug(error);
                return undefined;
            }
        }
    }

    public async getUserInfo(token: string | TokenSet) : Promise<UserInfo | undefined>{
        let code = token instanceof TokenSet ? token.access_token : token;

        let cache = this.getFromCache(code);
        if(cache) return cache; //If there is something in cache return

        let client = await this.client;

        try {
            let userInfo : UserinfoResponse<UserInfo> = await client.userinfo(token);
            let userCache = new UserCache(userInfo, this.cacheTTL);
            this.setUserInfoToCache(userCache, code);
            return userCache;
        }catch (e) {
            return undefined; //Unable to fetch user information, just return
        }
    }

    private getFromCache(code: string) : UserInfo | undefined{
        if(!this.userCache) return undefined; //cache is disabled

        let currentCache = this.userCache.get(code);
        if(currentCache && !currentCache.expired) return currentCache;
    }

    private setUserInfoToCache(userCache : UserCache, code: string){
        if(!this.userCache) return;

        this.userCache.set(code, userCache);
    }

}

class UserCache implements UserInfo{
    constructor(userInfo : UserInfo, ttl: number) {
        this.sub = userInfo.sub;
        this.name = userInfo.name;
        this.description = userInfo.description;
        this.birthdate = userInfo.birthdate;
        this.birthdateTimestamp = userInfo.birthdateTimestamp;
        this.group = userInfo.group;
        this.type = userInfo.type;
        this.email = userInfo.email;

        this.cacheLoaded = new Date();
        this.ttl = ttl;
    }

    sub: string;
    name: string;
    description: string;
    birthdate: string;
    birthdateTimestamp: string;
    group: string;
    type: string;
    email: string;

    cacheLoaded : Date;
    ttl: number;

    get expired(): boolean {
        let currentEpochTime = Math.round((new Date()).getTime() / 1000);
        let generateEpochTime = Math.round((this.cacheLoaded).getTime() / 1000);

        let timePassed = currentEpochTime - generateEpochTime; //check the amount of time passed in seconds
        return timePassed > this.ttl; //If the cache has been there for (TIME TO EXPIRE)ms, expire the cache
    }
}

/**
 * Store the issuer options in case there is anything custom
 */
export type IssuerOptions = {
    cacheEnabled?: boolean, //Default True
    cacheTTL?: number; //Number in seconds for TTL
}