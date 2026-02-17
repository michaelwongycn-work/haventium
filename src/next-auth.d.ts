import { DefaultSession } from "next-auth";
import { UserRole } from "@/lib/access-utils";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      subscription: any;
      roles: UserRole[];
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    subscription: any;
    roles: UserRole[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    subscription: any;
    roles: UserRole[];
  }
}
