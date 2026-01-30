import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ListUsersRequest {
  action: "list";
}

interface CreateUserRequest {
  action: "create";
  email: string;
  password: string;
  nome: string;
  role?: "admin" | "encarregado" | "operador" | "visualizador";
}

interface DeleteUserRequest {
  action: "delete";
  userId: string;
}

interface UpdatePasswordRequest {
  action: "update_password";
  userId: string;
  newPassword: string;
}

interface ToggleActiveRequest {
  action: "toggle_active";
  userId: string;
  active: boolean;
}

type RequestBody = ListUsersRequest | CreateUserRequest | DeleteUserRequest | UpdatePasswordRequest | ToggleActiveRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin permission required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();

    // LIST USERS - Returns all profiles with their roles (admin only)
    if (body.action === "list") {
      // Fetch all profiles using service role (bypasses RLS)
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email, ativo")
        .order("nome");

      if (profilesError) {
        return new Response(
          JSON.stringify({ error: profilesError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch all roles
      const { data: allRoles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) {
        return new Response(
          JSON.stringify({ error: rolesError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Merge profiles with roles
      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (allRoles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role),
      }));

      return new Response(
        JSON.stringify({ success: true, users: usersWithRoles }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "create") {
      const { email, password, nome, role } = body;

      if (!email || !password || !nome) {
        return new Response(
          JSON.stringify({ error: "Email, password and nome are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user with admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If role specified, add it
      if (role && newUser.user) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          user: { id: newUser.user?.id, email: newUser.user?.email } 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "delete") {
      const { userId } = body;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent self-deletion
      if (userId === requestingUser.id) {
        return new Response(
          JSON.stringify({ error: "Cannot delete your own account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete user (this will cascade to user_roles due to foreign key)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "update_password") {
      const { userId, newPassword } = body;

      if (!userId || !newPassword) {
        return new Response(
          JSON.stringify({ error: "userId and newPassword are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (body.action === "toggle_active") {
      const { userId, active } = body;

      if (!userId || typeof active !== "boolean") {
        return new Response(
          JSON.stringify({ error: "userId and active (boolean) are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent self-deactivation
      if (userId === requestingUser.id && !active) {
        return new Response(
          JSON.stringify({ error: "Cannot deactivate your own account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile active status using service role (bypasses RLS)
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ ativo: active })
        .eq("id", userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in manage-users function:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
