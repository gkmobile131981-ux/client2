import React from 'react';
import { UserSquare2, Plus, ShieldAlert, Award } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const mockStaff = [
  { id: '1', name: 'GK Owner', role: 'owner', email: 'owner@gkrepair.com', active: true, badge: 'OWNER-001' },
  { id: '2', name: 'GK Staff', role: 'staff', email: 'staff@gkrepair.com', active: true, badge: 'STF-001' },
];

export default function Staff() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Staff Management</h2>
          <p className="text-muted-foreground text-sm">Manage employee profiles and dashboard permissions.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mockStaff.map((emp) => (
          <Card key={emp.id} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    emp.role === 'owner' ? 'bg-primary/20 text-primary-foreground' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {emp.role === 'owner' ? <ShieldAlert className="h-3 w-3" /> : <Award className="h-3 w-3" />}
                    {emp.role}
                  </span>
                  <h3 className="font-bold text-lg text-white mt-2">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                  <p className="text-xs font-mono text-muted-foreground/60 mt-1">Badge #: {emp.badge}</p>
                </div>
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" title="Active" />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" size="sm">Modify</Button>
                {emp.role !== 'owner' && (
                  <Button variant="destructive" size="sm">Suspend</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
