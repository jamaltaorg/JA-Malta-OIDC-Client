# JA Malta OIDC Relaying Party Module

This module is meant to be used when needing authentication with the JA Malta Platforms.  The authentication, ran under the URI auth.jamalta.org, uses OpenID Connect specs and discovery - [discovery url](https://auth.jamalta.org/.well-known/openid-configuration).  

**Please note that the authentication and this connector is still in the early alpha testing.  Currently, this module is meant to be used internally until everything is tested**.

## Features
The connector has the following available features:
1. Express Middleware to authenticate a token including a cache that lasts as long as the access-token
2. UserInfo cache, to not constantly call the authentication endpoint everytime user info is needed.
3. OpenID Discovery Specs

#### Assumptions
Cookie Middleware (such as cookie parser).
ExpressJS being used

## Getting Started
Getting started is pretty easy.  

#### Creating the issuer
```js 
let issuer = new JAMaltaIssuer(clientId, clientSecret, redirectUris, responseTypes, scopes);
```

#### Getting the login url
Once the issuer is created, one can get the authorisation url by doing:
```js
let url = await issuer.authorisationUrl;
```

#### Login Callback
From there onwards, create an express route with the callback and **implement the callback middleware**.  The callback middleware creates a cookie on the frontend which can be read by the authentication middleware.
```js
expressApp.get("/callback", callbackMiddleware(issuer), (req, res) => {
    //your code here
    res.sendStatus(200);
});
```

#### Authentication Middleware
After initial authentication is done, the issuer does everything for you using the authentication middleware.
```js
expressApp.get("/your-endpoint", authenticate(issuer), (req, res) => {
    let userinfo = req.jaUserInfo;
    res.sendStatus(200);
})
```
The user info is then stored into the request as seen above, and can be used in any way needed.

#### Logout
The issuer also provides the functionality to logout easily by doing `let url = await issuer.getLogoutUrl(token);`
```js
expressApp.get("/logout", authenticate(issuer), (req, res) => {
   issuer.getLogoutUrl(req.tokenCode).then(value => res.redirect(value));
})
```

## Developer Features
### Custom Issuer URL
In the case that you are developing onto the OIDC Relay, and want to use a custom issuer URL, you can set the environment variable `CUSTOM_ISSUER_URL` which forces auto-discovery and endpoint binding to that OIDC Provider, **assuming OIDC discovery is enabled on the OIDC Provider**. 
