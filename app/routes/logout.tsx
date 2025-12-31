import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { createLogoutCookie } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  // Logout via GET request - redirect to login with logout cookie
  return redirect("/login", {
    headers: {
      "Set-Cookie": createLogoutCookie(),
    },
  });
}

export async function action({ request }: Route.ActionArgs) {
  // Logout via POST request - redirect to login with logout cookie
  return redirect("/login", {
    headers: {
      "Set-Cookie": createLogoutCookie(),
    },
  });
}
