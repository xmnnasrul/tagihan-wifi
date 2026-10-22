'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type ExportFormat = 'csv' | 'xlsx' | 'txt';

const exportFields = [
  { value: 'customerName', label: 'Nama pelanggan' },
  { value: 'address', label: 'Alamat' },
] as const;

export default function ExportPage() {
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');
  const [status, setStatus] = useState('all');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [columns, setColumns] = useState<string[]>(exportFields.map((field) => field.value));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleExport = async () => {
    const params = new URLSearchParams({ format });
    if (month !== 'all') params.set('month', month);
    if (year !== 'all') params.set('year', year);
    if (status !== 'all') params.set('status', status);
    params.set('columns', columns.join(','));

    setIsExporting(true);
    setExportError('');
    try {
      const response = await fetch(`/api/billings/export?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorData?.error || 'Gagal mengekspor data.');
      }

      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        || `tagihan.${format}`;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal mengekspor data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ekspor Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unduh data tagihan sesuai periode dan format yang kamu perlukan.</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Pengaturan Ekspor
          </CardTitle>
          <CardDescription>Pilih periode, status, kolom yang ingin disertakan, dan format file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bulan tagihan</label>
              <Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setMonthPickerOpen(true)}>
                {month === 'all' ? 'Semua Bulan' : month}
                <span className="text-xs text-muted-foreground">Pilih</span>
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun tagihan</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {Array.from({ length: 5 }, (_, index) => 2026 + index).map((item) => (
                    <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="export-status" className="text-sm font-medium">Status pembayaran</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="export-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Belum Bayar">Belum Bayar</SelectItem>
                  <SelectItem value="Nyicil">Nyicil</SelectItem>
                  <SelectItem value="Cash">Cash / Tunai</SelectItem>
                  <SelectItem value="TF">Transfer</SelectItem>
                  <SelectItem value="Lunas">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Kolom yang diekspor</label>
            </div>
            <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {exportFields.map((field) => (
                <label key={field.value} htmlFor={`export-column-${field.value}`} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    id={`export-column-${field.value}`}
                    checked={columns.includes(field.value)}
                    onCheckedChange={(checked) => setColumns((current) => (
                      checked
                        ? [...current, field.value]
                        : current.filter((column) => column !== field.value)
                    ))}
                  />
                  {field.label}
                </label>
              ))}
            </div>
            {columns.length === 0 && <p role="alert" className="text-sm text-destructive">Pilih minimal satu kolom.</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Format file</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button type="button" variant={format === 'csv' ? 'default' : 'outline'} className="justify-start gap-2" onClick={() => setFormat('csv')}>
                <FileText className="h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant={format === 'xlsx' ? 'default' : 'outline'} className="justify-start gap-2" onClick={() => setFormat('xlsx')}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel (.xlsx)
              </Button>
              <Button type="button" variant={format === 'txt' ? 'default' : 'outline'} className="justify-start gap-2" onClick={() => setFormat('txt')}>
                <FileText className="h-4 w-4" />
                Teks (.txt)
              </Button>
            </div>
          </div>

          {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}

          <div className="flex justify-end border-t border-border pt-5">
            <Button type="button" className="gap-2" onClick={() => void handleExport()} disabled={!columns.length || isExporting}>
              <Download className="h-4 w-4" />
              Unduh file
            </Button>
            {isExporting && <span role="status" className="sr-only">Menyiapkan ekspor...</span>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Bulan Tagihan</DialogTitle>
            <DialogDescription>Pilih satu bulan atau semua data.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Button type="button" variant={month === 'all' ? 'default' : 'outline'} onClick={() => {
              setMonth('all');
              setMonthPickerOpen(false);
            }}>
              Semua
            </Button>
            {months.map((item, index) => (
              <Button key={item} type="button" variant={month === item ? 'default' : 'outline'} onClick={() => {
                setMonth(item);
                setMonthPickerOpen(false);
              }}>
                {monthShortNames[index]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
