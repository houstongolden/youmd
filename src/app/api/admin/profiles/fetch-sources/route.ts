import { adminProfileOptions, proxyAdminProfilePost } from "../_lib";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyAdminProfilePost(request, "/api/admin/profiles/fetch-sources");
}

export async function OPTIONS() {
  return adminProfileOptions();
}
