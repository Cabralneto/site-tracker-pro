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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1a202c; 
              margin: 0;
              padding: 0;
              background-color: #f7fafc;
            }
            .wrapper {
              background-color: #f7fafc;
              padding: 40px 20px;
            }
            .container { 
              max-width: 560px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.05);
            }
            .header { 
              background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 50%, #3182ce 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .logo-icon {
              width: 64px;
              height: 64px;
              background: rgba(255, 255, 255, 0.15);
              border-radius: 16px;
              margin: 0 auto 16px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .header p {
              margin: 8px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .content { 
              padding: 40px 30px; 
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              color: #1a365d;
              margin: 0 0 20px 0;
            }
            .message {
              font-size: 16px;
              color: #4a5568;
              margin: 0 0 16px 0;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%); 
              color: white !important; 
              text-decoration: none; 
              padding: 16px 40px; 
              border-radius: 8px; 
              font-weight: 600; 
              font-size: 16px;
              box-shadow: 0 4px 14px rgba(49, 130, 206, 0.4);
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(49, 130, 206, 0.5);
            }
            .warning { 
              background: linear-gradient(135deg, #fefcbf 0%, #fef3c7 100%); 
              border-left: 4px solid #ecc94b;
              padding: 16px 20px; 
              border-radius: 0 8px 8px 0; 
              margin: 24px 0;
              font-size: 14px;
              color: #744210;
            }
            .warning strong {
              color: #975a16;
            }
            .divider {
              height: 1px;
              background: #e2e8f0;
              margin: 24px 0;
            }
            .footer-note {
              font-size: 13px;
              color: #a0aec0;
              margin: 0;
            }
            .footer { 
              background: #f7fafc;
              text-align: center; 
              padding: 24px 30px;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 4px 0;
              font-size: 12px;
              color: #718096;
            }
            .footer .brand {
              font-weight: 600;
              color: #4a5568;
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <div class="logo-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <h1>PT Control</h1>
                <p>Sistema de Controle de Permissões de Trabalho</p>
              </div>
              <div class="content">
                <p class="greeting">Olá, ${nome}!</p>
                <p class="message">
                  Você foi convidado para acessar o sistema <strong>PT Control</strong>.
                </p>
                <p class="message">
                  Para começar, você precisa definir sua senha de acesso. Clique no botão abaixo para criar sua senha:
                </p>
                <div class="button-container">
                  <a href="${inviteLink}" class="button">Definir Minha Senha</a>
                </div>
                <div class="warning">
                  ⏰ <strong>Atenção:</strong> Este link é válido por <strong>7 dias</strong> e só pode ser usado uma vez.
                </div>
                <div class="divider"></div>
                <p class="footer-note">
                  Se você não solicitou este acesso, ignore este e-mail com segurança.
                </p>
              </div>
              <div class="footer">
                <p class="brand">Equipe PT Control</p>
                <p>Este é um e-mail automático, não responda.</p>
              </div>
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
