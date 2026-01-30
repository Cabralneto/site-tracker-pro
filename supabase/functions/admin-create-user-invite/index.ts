import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserInviteRequest {
  email: string;
  nome: string;
  role?: "admin" | "encarregado" | "operador" | "visualizador";
}

async function sendEmailViaResend(apiKey: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PT Control <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Resend API error:", errorData);
    throw new Error(errorData.message || "Failed to send email");
  }

  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração de email incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Rate limiting: max 10 creations per admin per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin
      .from("invite_rate_limits")
      .select("id")
      .eq("admin_id", requestingUser.id)
      .eq("action_type", "create")
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    }

    if (rateLimitData && rateLimitData.length >= 10) {
      return new Response(
        JSON.stringify({ error: "Limite de criação de usuários atingido. Aguarde 1 hora." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateUserInviteRequest = await req.json();
    const { email, nome, role } = body;

    if (!email || !nome) {
      return new Response(
        JSON.stringify({ error: "Email e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate invite expiration (7 days)
    const inviteSentAt = new Date();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create user with Admin API - generate invite link
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { nome },
      },
    });

    if (inviteError) {
      console.error("Error generating invite link:", inviteError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar convite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = inviteData.user?.id;
    const inviteLink = inviteData.properties?.action_link;

    if (!userId || !inviteLink) {
      console.error("Missing user ID or invite link in response");
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de convite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with invite info (profile is auto-created by trigger)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        nome,
        force_password_change: true,
        invite_sent_at: inviteSentAt.toISOString(),
        invite_expires_at: inviteExpiresAt.toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Profile might not exist yet due to trigger timing, try upsert
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          nome,
          email,
          force_password_change: true,
          invite_sent_at: inviteSentAt.toISOString(),
          invite_expires_at: inviteExpiresAt.toISOString(),
        });
    }

    // Insert into profiles_directory
    await supabaseAdmin
      .from("profiles_directory")
      .upsert({ id: userId, nome });

    // Add role if specified
    if (role) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });
    }

    // Send invite email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3182ce; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 20px; }
            .warning { background: #fef3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin-top: 20px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">PT Control</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema de Controle de Permissões de Trabalho</p>
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Olá, ${nome}!</h2>
              <p>Você foi convidado para acessar o sistema PT Control.</p>
              <p>Clique no botão abaixo para definir sua senha de acesso:</p>
              <p style="text-align: center;">
                <a href="${inviteLink}" class="button">Definir Minha Senha</a>
              </p>
              <div class="warning">
                ⏰ <strong>Atenção:</strong> Este link é válido por 7 dias e só pode ser usado uma vez.
              </div>
              <p style="margin-top: 20px; font-size: 14px; color: #718096;">
                Se você não solicitou este acesso, ignore este e-mail.
              </p>
            </div>
            <div class="footer">
              <p>Equipe PT Control</p>
              <p>Este é um e-mail automático, não responda.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmailViaResend(resendApiKey, email, "Defina sua senha - PT Control", emailHtml);
      console.log("Email sent successfully to:", email);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the whole operation if email fails - user was created
      // Admin can resend the invite
    }

    // Log rate limit
    await supabaseAdmin
      .from("invite_rate_limits")
      .insert({
        admin_id: requestingUser.id,
        target_user_id: userId,
        action_type: "create",
      });

    // Log audit
    await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        admin_id: requestingUser.id,
        action: "create_user_invite",
        target_user_id: userId,
        metadata: { email, nome, role },
      });

    console.log(`User ${email} invited successfully by admin ${requestingUser.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in admin-create-user-invite:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
