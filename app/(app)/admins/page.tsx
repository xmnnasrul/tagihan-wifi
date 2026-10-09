'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Pencil, Shield, Trash2, UserPlus, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/components/CurrentUserProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { USER_ROLES, UserRole } from '@/lib/roles';

const roleLabels: Record<UserRole, string> = { user: 'User (hanya baca)', collector: 'Collector', admin: 'Admin' };

function updateRoles(currentRoles: UserRole[], role: UserRole, checked: boolean): UserRole[] {
  if (role === 'user') return checked ? ['user'] : currentRoles.some((item) => item !== 'user') ? currentRoles.filter((item) => item !== 'user') : ['user'];
  const nextRoles = currentRoles.filter((item) => item !== 'user' && item !== role);
  if (checked) nextRoles.push(role);
  return nextRoles.length ? nextRoles : ['user'];
}

interface Admin {
  _id: string;
  username: string;
  role: string;
  roles: UserRole[];
  isActive: boolean;
  createdAt: string;
}

export default function AdminsPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canManageAccounts = currentUser?.roles.includes('admin') ?? false;
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentUsername, setCurrentUsername] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newAccountRoles, setNewAccountRoles] = useState<UserRole[]>(['user']);
  const [roleEditingAccount, setRoleEditingAccount] = useState<Admin | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch('/api/admins');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengambil data admin');
      setAdmins(data.admins);
      setCurrentUsername(data.currentUsername);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal mengambil data admin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageAccounts) void fetchAdmins();
  }, [canManageAccounts, fetchAdmins]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, roles: newAccountRoles }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat akun admin');
      setUsername('');
      setPassword('');
      setNewAccountRoles(['user']);
      toast.success('Akun pengguna berhasil dibuat');
      await fetchAdmins();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Gagal membuat akun admin');
    } finally {
      setSaving(false);
    }
  };

  const openRoleEditor = (admin: Admin) => {
    setRoleEditingAccount(admin);
    setRoleDraft(admin.roles);
  };

  const handleSaveRoles = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleEditingAccount) return;
    setSavingRoles(true);
    try {
      const response = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roleEditingAccount._id, roles: roleDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah role akun');
      toast.success(data.message || 'Role akun diperbarui');
      setRoleEditingAccount(null);
      if (data.requiresLogin) {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
        return;
      }
      await fetchAdmins();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Gagal mengubah role akun');
    } finally {
      setSavingRoles(false);
    }
  };

  const handleToggle = async (admin: Admin) => {
    const nextStatus = !admin.isActive;
    if (!nextStatus && !window.confirm(`Nonaktifkan akun ${admin.username}?`)) return;

    try {
      const response = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: admin._id, isActive: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah status admin');
      toast.success(data.message);
      await fetchAdmins();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Gagal mengubah status admin');
    }
  };

  const handleDeleteUser = async (admin: Admin) => {
    if (admin.roles.includes('admin')) {
      toast.error('Akun dengan role admin tidak bisa dihapus');
      return;
    }

    const confirmed = window.confirm(`Hapus akun ${admin.username}? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admins?id=${admin._id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus akun');
      toast.success(data.message);
      await fetchAdmins();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Gagal menghapus akun');
    }
  };

  if (!canManageAccounts) {
    return <div role="alert" className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">Halaman pengelolaan akun hanya dapat diakses admin.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengelolaan Akun</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur akun admin dan pengguna operasional.</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <section className="mx-auto w-full max-w-[700px] rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Akun baru</p>
            <h2 className="text-xl font-semibold">Tambah Pengguna</h2>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="admin-username" className="text-sm font-medium">Username</Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              className="h-11 focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="admin-password" className="text-sm font-medium">Password awal</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              className="h-11 focus-visible:ring-primary/30"
              required
            />
          </div>
          <fieldset className="space-y-3 rounded-md border border-border p-3 md:col-span-2">
            <legend className="px-1 text-sm font-medium">Role akun</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {USER_ROLES.map((role) => (
                <label key={role} htmlFor={`new-role-${role}`} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    id={`new-role-${role}`}
                    checked={newAccountRoles.includes(role)}
                    onCheckedChange={(checked) => setNewAccountRoles((current) => updateRoles(current, role, checked === true))}
                  />
                  {roleLabels[role]}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Pilih Admin dan Collector sekaligus bila akun perlu mengelola data sekaligus mencatat setoran.</p>
          </fieldset>
          <div className="md:col-span-2 flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Buat akun pengguna
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Semua Akun</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun admin...
          </div>
        ) : admins.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Tidak ada akun admin.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Akun</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin._id}>
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {admin.username}{admin.username === currentUsername ? ' (Anda)' : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.roles.map((role) => <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>{roleLabels[role]}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.isActive ? 'default' : 'secondary'}>
                        {admin.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(admin.createdAt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleEditor(admin)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />Role
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={admin.username === currentUsername && admin.isActive}
                          onClick={() => void handleToggle(admin)}
                        >
                          {admin.isActive ? <UserRoundX className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                          {admin.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        {!admin.roles.includes('admin') && (
                          <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteUser(admin)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={Boolean(roleEditingAccount)} onOpenChange={(open) => !open && !savingRoles && setRoleEditingAccount(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atur role akun</DialogTitle>
            <DialogDescription>{roleEditingAccount?.username}. Perubahan role akan mengakhiri sesi akun tersebut.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRoles} className="space-y-5">
            <div className="space-y-3">
              {USER_ROLES.map((role) => (
                <label key={role} htmlFor={`edit-role-${role}`} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-sm">
                  <Checkbox
                    id={`edit-role-${role}`}
                    checked={roleDraft.includes(role)}
                    onCheckedChange={(checked) => setRoleDraft((current) => updateRoles(current, role, checked === true))}
                  />
                  <span>{roleLabels[role]}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleEditingAccount(null)} disabled={savingRoles}>Batal</Button>
              <Button type="submit" disabled={savingRoles}>
                {savingRoles ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Simpan role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}