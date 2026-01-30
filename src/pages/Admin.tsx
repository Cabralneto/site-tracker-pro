import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  MapPin, 
  Wrench, 
  AlertTriangle, 
  Clock,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  Shield,
  UserX,
  UserCheck,
  Key
} from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'encarregado' | 'operador' | 'visualizador';

interface UserWithRoles {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  roles: AppRole[];
}

interface Frente {
  id: string;
  nome: string;
  area: string | null;
  ativo: boolean;
}

interface Disciplina {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Impedimento {
  id: string;
  nome: string;
  ativo: boolean;
}

interface SLAConfig {
  id: string;
  hora_limite_solicitacao: string;
  hora_limite_liberacao: string;
  timezone: string;
}

export default function Admin() {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  
  // Users state
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Frentes state
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [loadingFrentes, setLoadingFrentes] = useState(true);
  const [newFrenteName, setNewFrenteName] = useState('');
  const [newFrenteArea, setNewFrenteArea] = useState('');
  const [editingFrente, setEditingFrente] = useState<Frente | null>(null);
  
  // Disciplinas state
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(true);
  const [newDisciplinaName, setNewDisciplinaName] = useState('');
  const [editingDisciplina, setEditingDisciplina] = useState<Disciplina | null>(null);
  
  // Impedimentos state
  const [impedimentos, setImpedimentos] = useState<Impedimento[]>([]);
  const [loadingImpedimentos, setLoadingImpedimentos] = useState(true);
  const [newImpedimentoName, setNewImpedimentoName] = useState('');
  const [editingImpedimento, setEditingImpedimento] = useState<Impedimento | null>(null);
  
  // SLA Config state
  const [slaConfig, setSlaConfig] = useState<SLAConfig | null>(null);
  const [loadingSLA, setLoadingSLA] = useState(true);
  const [slaHoraSolicitacao, setSlaHoraSolicitacao] = useState('07:30');
  const [slaHoraLiberacao, setSlaHoraLiberacao] = useState('08:15');
  
  // Role management
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('operador');

  // Create user state
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('operador');
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Change password state
  const [changePasswordUserId, setChangePasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchFrentes();
      fetchDisciplinas();
      fetchImpedimentos();
      fetchSLAConfig();
    }
  }, [isAdmin]);

  // ========== USERS ==========
  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      // Use edge function to fetch users (bypasses RLS, admin-only)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao buscar usuários');
      }

      setUsers(result.users as UserWithRoles[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function addRoleToUser(userId: string, role: AppRole) {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;

      toast.success('Permissão adicionada');
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast.error(error.message || 'Erro ao adicionar permissão');
    }
  }

  async function removeRoleFromUser(userId: string, role: AppRole) {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success('Permissão removida');
      fetchUsers();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast.error(error.message || 'Erro ao remover permissão');
    }
  }

  async function toggleUserActive(userId: string, currentStatus: boolean) {
    try {
      // Use edge function to toggle user status (bypasses RLS, admin-only)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            action: 'toggle_active',
            userId,
            active: !currentStatus,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar status');
      }

      toast.success(currentStatus ? 'Usuário desativado' : 'Usuário ativado');
      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast.error(error.message || 'Erro ao alterar status do usuário');
    }
  }

  async function createUser() {
    if (!newUserEmail || !newUserPassword || !newUserNome) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'create',
            email: newUserEmail,
            password: newUserPassword,
            nome: newUserNome,
            role: newUserRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast.success('Usuário criado com sucesso');
      setCreateUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserNome('');
      setNewUserRole('operador');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreatingUser(false);
    }
  }

  async function deleteUser(userId: string) {
    setDeletingUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'delete',
            userId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }

      toast.success('Usuário excluído com sucesso');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
    } finally {
      setDeletingUserId(null);
    }
  }

  async function changeUserPassword(userId: string) {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'update_password',
            userId,
            newPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar senha');
      }

      toast.success('Senha alterada com sucesso');
      setPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordUserId(null);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  }

  // ========== FRENTES ==========
  async function fetchFrentes() {
    setLoadingFrentes(true);
    try {
      const { data, error } = await supabase
        .from('frentes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setFrentes(data || []);
    } catch (error) {
      console.error('Error fetching frentes:', error);
    } finally {
      setLoadingFrentes(false);
    }
  }

  async function createFrente() {
    if (!newFrenteName.trim()) return;
    try {
      const { error } = await supabase
        .from('frentes')
        .insert({ nome: newFrenteName, area: newFrenteArea || null, criado_por: user?.id });

      if (error) throw error;

      toast.success('Frente criada');
      setNewFrenteName('');
      setNewFrenteArea('');
      fetchFrentes();
    } catch (error: any) {
      console.error('Error creating frente:', error);
      toast.error(error.message || 'Erro ao criar frente');
    }
  }

  async function updateFrente() {
    if (!editingFrente) return;
    try {
      const { error } = await supabase
        .from('frentes')
        .update({ nome: editingFrente.nome, area: editingFrente.area })
        .eq('id', editingFrente.id);

      if (error) throw error;

      toast.success('Frente atualizada');
      setEditingFrente(null);
      fetchFrentes();
    } catch (error: any) {
      console.error('Error updating frente:', error);
      toast.error(error.message || 'Erro ao atualizar frente');
    }
  }

  async function toggleFrenteActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('frentes')
        .update({ ativo: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Frente desativada' : 'Frente ativada');
      fetchFrentes();
    } catch (error: any) {
      toast.error('Erro ao alterar status');
    }
  }

  // ========== DISCIPLINAS ==========
  async function fetchDisciplinas() {
    setLoadingDisciplinas(true);
    try {
      const { data, error } = await supabase
        .from('disciplinas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setDisciplinas(data || []);
    } catch (error) {
      console.error('Error fetching disciplinas:', error);
    } finally {
      setLoadingDisciplinas(false);
    }
  }

  async function createDisciplina() {
    if (!newDisciplinaName.trim()) return;
    try {
      const { error } = await supabase
        .from('disciplinas')
        .insert({ nome: newDisciplinaName, criado_por: user?.id });

      if (error) throw error;

      toast.success('Disciplina criada');
      setNewDisciplinaName('');
      fetchDisciplinas();
    } catch (error: any) {
      console.error('Error creating disciplina:', error);
      toast.error(error.message || 'Erro ao criar disciplina');
    }
  }

  async function updateDisciplina() {
    if (!editingDisciplina) return;
    try {
      const { error } = await supabase
        .from('disciplinas')
        .update({ nome: editingDisciplina.nome })
        .eq('id', editingDisciplina.id);

      if (error) throw error;

      toast.success('Disciplina atualizada');
      setEditingDisciplina(null);
      fetchDisciplinas();
    } catch (error: any) {
      console.error('Error updating disciplina:', error);
      toast.error(error.message || 'Erro ao atualizar disciplina');
    }
  }

  async function toggleDisciplinaActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('disciplinas')
        .update({ ativo: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Disciplina desativada' : 'Disciplina ativada');
      fetchDisciplinas();
    } catch (error: any) {
      toast.error('Erro ao alterar status');
    }
  }

  // ========== IMPEDIMENTOS ==========
  async function fetchImpedimentos() {
    setLoadingImpedimentos(true);
    try {
      const { data, error } = await supabase
        .from('impedimentos')
        .select('*')
        .order('nome');

      if (error) throw error;
      setImpedimentos(data || []);
    } catch (error) {
      console.error('Error fetching impedimentos:', error);
    } finally {
      setLoadingImpedimentos(false);
    }
  }

  async function createImpedimento() {
    if (!newImpedimentoName.trim()) return;
    try {
      const { error } = await supabase
        .from('impedimentos')
        .insert({ nome: newImpedimentoName, criado_por: user?.id });

      if (error) throw error;

      toast.success('Motivo de impedimento criado');
      setNewImpedimentoName('');
      fetchImpedimentos();
    } catch (error: any) {
      console.error('Error creating impedimento:', error);
      toast.error(error.message || 'Erro ao criar impedimento');
    }
  }

  async function updateImpedimento() {
    if (!editingImpedimento) return;
    try {
      const { error } = await supabase
        .from('impedimentos')
        .update({ nome: editingImpedimento.nome })
        .eq('id', editingImpedimento.id);

      if (error) throw error;

      toast.success('Impedimento atualizado');
      setEditingImpedimento(null);
      fetchImpedimentos();
    } catch (error: any) {
      console.error('Error updating impedimento:', error);
      toast.error(error.message || 'Erro ao atualizar impedimento');
    }
  }

  async function toggleImpedimentoActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('impedimentos')
        .update({ ativo: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Impedimento desativado' : 'Impedimento ativado');
      fetchImpedimentos();
    } catch (error: any) {
      toast.error('Erro ao alterar status');
    }
  }

  // ========== SLA CONFIG ==========
  async function fetchSLAConfig() {
    setLoadingSLA(true);
    try {
      const { data, error } = await supabase
        .from('sla_config')
        .select('*')
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSlaConfig(data);
        setSlaHoraSolicitacao(data.hora_limite_solicitacao);
        setSlaHoraLiberacao(data.hora_limite_liberacao);
      }
    } catch (error) {
      console.error('Error fetching SLA config:', error);
    } finally {
      setLoadingSLA(false);
    }
  }

  async function saveSLAConfig() {
    try {
      if (slaConfig) {
        // Update existing
        const { error } = await supabase
          .from('sla_config')
          .update({
            hora_limite_solicitacao: slaHoraSolicitacao,
            hora_limite_liberacao: slaHoraLiberacao,
          })
          .eq('id', slaConfig.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('sla_config')
          .insert({
            hora_limite_solicitacao: slaHoraSolicitacao,
            hora_limite_liberacao: slaHoraLiberacao,
            criado_por: user?.id,
          });

        if (error) throw error;
      }

      toast.success('Configuração de SLA salva');
      fetchSLAConfig();
    } catch (error: any) {
      console.error('Error saving SLA config:', error);
      toast.error(error.message || 'Erro ao salvar configuração');
    }
  }

  const getRoleBadgeColor = (role: AppRole) => {
    const colors: Record<AppRole, string> = {
      admin: 'bg-destructive/20 text-destructive',
      encarregado: 'bg-warning/20 text-warning',
      operador: 'bg-info/20 text-info',
      visualizador: 'bg-muted text-muted-foreground',
    };
    return colors[role];
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Administração</h1>
          <p className="text-muted-foreground">Gerenciamento do sistema</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="frentes" className="text-xs">
              <MapPin className="h-4 w-4 mr-1" />
              Frentes
            </TabsTrigger>
            <TabsTrigger value="disciplinas" className="text-xs">
              <Wrench className="h-4 w-4 mr-1" />
              Disciplinas
            </TabsTrigger>
            <TabsTrigger value="impedimentos" className="text-xs">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Impedimentos
            </TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">
              <Clock className="h-4 w-4 mr-1" />
              SLA
            </TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Gerenciamento de Usuários</CardTitle>
                <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Novo Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input 
                          value={newUserNome} 
                          onChange={(e) => setNewUserNome(e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          type="email"
                          value={newUserEmail} 
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Senha *</Label>
                        <Input 
                          type="password"
                          value={newUserPassword} 
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Permissão Inicial</Label>
                        <Select value={newUserRole} onValueChange={(v: AppRole) => setNewUserRole(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="encarregado">Encarregado</SelectItem>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="visualizador">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" disabled={creatingUser}>Cancelar</Button>
                      </DialogClose>
                      <Button onClick={createUser} disabled={creatingUser}>
                        {creatingUser ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                        Criar Usuário
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Permissões</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {u.roles.length === 0 ? (
                                  <Badge variant="outline" className="text-xs">Sem permissão</Badge>
                                ) : (
                                  u.roles.map((role) => (
                                    <Badge key={role} variant="secondary" className={`text-xs ${getRoleBadgeColor(role)}`}>
                                      {role}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.ativo ? 'default' : 'secondary'} className={u.ativo ? 'bg-success/20 text-success' : ''}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedUser(u)}>
                                      <Shield className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Gerenciar Permissões</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <p className="font-medium">{u.nome}</p>
                                        <p className="text-sm text-muted-foreground">{u.email}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Permissões Atuais</Label>
                                        <div className="flex flex-wrap gap-2">
                                          {u.roles.length === 0 ? (
                                            <span className="text-sm text-muted-foreground">Nenhuma permissão</span>
                                          ) : (
                                            u.roles.map((role) => (
                                              <Badge key={role} variant="secondary" className={`${getRoleBadgeColor(role)} cursor-pointer`}>
                                                {role}
                                                <button 
                                                  className="ml-1 hover:text-destructive"
                                                  onClick={() => removeRoleFromUser(u.id, role)}
                                                >
                                                  ×
                                                </button>
                                              </Badge>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Adicionar Permissão</Label>
                                        <div className="flex gap-2">
                                          <Select value={selectedRole} onValueChange={(v: AppRole) => setSelectedRole(v)}>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="admin">Admin</SelectItem>
                                              <SelectItem value="encarregado">Encarregado</SelectItem>
                                              <SelectItem value="operador">Operador</SelectItem>
                                              <SelectItem value="visualizador">Visualizador</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Button onClick={() => addRoleToUser(u.id, selectedRole)}>
                                            <Plus className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {/* Change password button */}
                                <Dialog 
                                  open={passwordDialogOpen && changePasswordUserId === u.id} 
                                  onOpenChange={(open) => {
                                    setPasswordDialogOpen(open);
                                    if (!open) {
                                      setNewPassword('');
                                      setConfirmPassword('');
                                      setChangePasswordUserId(null);
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      title="Alterar senha"
                                      onClick={() => setChangePasswordUserId(u.id)}
                                    >
                                      <Key className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Alterar Senha</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <p className="font-medium">{u.nome}</p>
                                        <p className="text-sm text-muted-foreground">{u.email}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Nova Senha *</Label>
                                        <Input 
                                          type="password"
                                          value={newPassword}
                                          onChange={(e) => setNewPassword(e.target.value)}
                                          placeholder="Mínimo 6 caracteres"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Confirmar Senha *</Label>
                                        <Input 
                                          type="password"
                                          value={confirmPassword}
                                          onChange={(e) => setConfirmPassword(e.target.value)}
                                          placeholder="Digite novamente a senha"
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <DialogClose asChild>
                                        <Button variant="outline" disabled={changingPassword}>Cancelar</Button>
                                      </DialogClose>
                                      <Button onClick={() => changeUserPassword(u.id)} disabled={changingPassword}>
                                        {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
                                        Alterar Senha
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => toggleUserActive(u.id, u.ativo)}
                                  title={u.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                                >
                                  {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>

                                {/* Delete user button - only show if not the current user */}
                                {u.id !== user?.id && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        title="Excluir usuário"
                                        disabled={deletingUserId === u.id}
                                      >
                                        {deletingUserId === u.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja excluir o usuário <strong>{u.nome}</strong> ({u.email})?
                                          <br /><br />
                                          Esta ação é irreversível e todos os dados associados serão perdidos.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => deleteUser(u.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FRENTES TAB */}
          <TabsContent value="frentes" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Frentes de Serviço</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Frente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Frente de Serviço</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input 
                          value={newFrenteName} 
                          onChange={(e) => setNewFrenteName(e.target.value)}
                          placeholder="Ex: Frente A - Montagem"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Área (opcional)</Label>
                        <Input 
                          value={newFrenteArea} 
                          onChange={(e) => setNewFrenteArea(e.target.value)}
                          placeholder="Ex: Área Norte"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button onClick={createFrente}>Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingFrentes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {frentes.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{f.area || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={f.ativo ? 'default' : 'secondary'} className={f.ativo ? 'bg-success/20 text-success' : ''}>
                              {f.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setEditingFrente(f)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Frente</DialogTitle>
                                  </DialogHeader>
                                  {editingFrente && (
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Nome</Label>
                                        <Input 
                                          value={editingFrente.nome} 
                                          onChange={(e) => setEditingFrente({...editingFrente, nome: e.target.value})}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Área</Label>
                                        <Input 
                                          value={editingFrente.area || ''} 
                                          onChange={(e) => setEditingFrente({...editingFrente, area: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancelar</Button>
                                    </DialogClose>
                                    <Button onClick={updateFrente}>Salvar</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => toggleFrenteActive(f.id, f.ativo)}
                              >
                                {f.ativo ? <Trash2 className="h-4 w-4 text-destructive" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DISCIPLINAS TAB */}
          <TabsContent value="disciplinas" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Disciplinas</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Disciplina
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Disciplina</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input 
                          value={newDisciplinaName} 
                          onChange={(e) => setNewDisciplinaName(e.target.value)}
                          placeholder="Ex: Elétrica"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button onClick={createDisciplina}>Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingDisciplinas ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disciplinas.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.nome}</TableCell>
                          <TableCell>
                            <Badge variant={d.ativo ? 'default' : 'secondary'} className={d.ativo ? 'bg-success/20 text-success' : ''}>
                              {d.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setEditingDisciplina(d)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Disciplina</DialogTitle>
                                  </DialogHeader>
                                  {editingDisciplina && (
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Nome</Label>
                                        <Input 
                                          value={editingDisciplina.nome} 
                                          onChange={(e) => setEditingDisciplina({...editingDisciplina, nome: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancelar</Button>
                                    </DialogClose>
                                    <Button onClick={updateDisciplina}>Salvar</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => toggleDisciplinaActive(d.id, d.ativo)}
                              >
                                {d.ativo ? <Trash2 className="h-4 w-4 text-destructive" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IMPEDIMENTOS TAB */}
          <TabsContent value="impedimentos" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Motivos de Impedimento</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Motivo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Motivo de Impedimento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input 
                          value={newImpedimentoName} 
                          onChange={(e) => setNewImpedimentoName(e.target.value)}
                          placeholder="Ex: Falta de material"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                      </DialogClose>
                      <Button onClick={createImpedimento}>Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingImpedimentos ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impedimentos.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.nome}</TableCell>
                          <TableCell>
                            <Badge variant={i.ativo ? 'default' : 'secondary'} className={i.ativo ? 'bg-success/20 text-success' : ''}>
                              {i.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setEditingImpedimento(i)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Editar Impedimento</DialogTitle>
                                  </DialogHeader>
                                  {editingImpedimento && (
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Nome</Label>
                                        <Input 
                                          value={editingImpedimento.nome} 
                                          onChange={(e) => setEditingImpedimento({...editingImpedimento, nome: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancelar</Button>
                                    </DialogClose>
                                    <Button onClick={updateImpedimento}>Salvar</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => toggleImpedimentoActive(i.id, i.ativo)}
                              >
                                {i.ativo ? <Trash2 className="h-4 w-4 text-destructive" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SLA TAB */}
          <TabsContent value="sla" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração de SLA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingSLA ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hora Limite Solicitação</Label>
                        <Input
                          type="time"
                          value={slaHoraSolicitacao}
                          onChange={(e) => setSlaHoraSolicitacao(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Solicitações após este horário = Atraso ETM
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Hora Limite Liberação</Label>
                        <Input
                          type="time"
                          value={slaHoraLiberacao}
                          onChange={(e) => setSlaHoraLiberacao(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Liberações após este horário = Atraso Petrobras
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <h4 className="font-medium text-sm">Regras de Atraso</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <strong>Atraso ETM:</strong> Solicitação registrada após {slaHoraSolicitacao}</li>
                        <li>• <strong>Atraso Petrobras:</strong> Solicitação até {slaHoraSolicitacao} E Liberação após {slaHoraLiberacao}</li>
                        <li>• <strong>Sem Atraso:</strong> Liberação até {slaHoraLiberacao}</li>
                        <li>• <strong>Impedimento:</strong> PT não liberada (bloqueada)</li>
                      </ul>
                    </div>

                    <Button onClick={saveSLAConfig}>
                      Salvar Configuração
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
