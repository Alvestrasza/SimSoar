import createMiddleware from "next-intl/middleware";
import {routing} from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|embed|trpc|_next|_vercel|.*\\..*).*)"
};
