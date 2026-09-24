'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type ExportFormat = 'csv' | 'xlsx';

export default function ExportPage() {
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const handleExport = () => {
    const params = new URLSearchParams({ format });
    if (month !== 'all') params.set('month', month);
    if (year !== 'all') params.set('year', year);
    window.open(`/api/billings/export?${params.toString()}`, '_blank');
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
          <CardDescription>Pilih periode tagihan, kemudian pilih format file.</CardDescription>
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
                  {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((item) => (
                    <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Format file</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant={format === 'csv' ? 'default' : 'outline'} className="justify-start gap-2" onClick={() => setFormat('csv')}>
                <FileText className="h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant={format === 'xlsx' ? 'default' : 'outline'} className="justify-start gap-2" onClick={() => setFormat('xlsx')}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel (.xlsx)
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-border pt-5">
            <Button type="button" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Unduh {format === 'xlsx' ? 'Excel' : 'CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="sm:max-w-sm">
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
