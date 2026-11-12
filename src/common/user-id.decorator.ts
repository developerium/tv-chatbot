import { createParamDecorator } from '@nestjs/common'

// Every request belongs to this user until authentication is added.
// The nil UUID, so it has the same format as real user ids.
export const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000'

// The only way handlers get the user id; never read it from the request.
// TODO: return the user id AuthGuard stored on the request from the JWT.
export const UserId = createParamDecorator((): string => PLACEHOLDER_USER_ID)
