import { type CanActivate, Injectable } from '@nestjs/common'

// Runs on every request (registered as APP_GUARD in AppModule).
// Placeholder: lets every request through until authentication is added.
// TODO: read the bearer token from the Authorization header, verify the JWT
// (signature, expiry, issuer, audience), throw UnauthorizedException if it is
// missing or invalid, and store its `sub` on the request for @UserId().
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    return true
  }
}
