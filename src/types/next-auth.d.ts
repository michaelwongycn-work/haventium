import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      organizationId: string
      subscription: any
      roles: any[]
    } & DefaultSession["user"]
  }

  interface User {
    organizationId: string
    subscription: any
    roles: any[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    organizationId: string
    subscription: any
    roles: any[]
  }
}
