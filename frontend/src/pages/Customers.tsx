import React from 'react';
import { Users, Plus, Phone, Mail, MapPin } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const mockCustomers = [
  { id: '1', name: 'John Doe', phone: '+1987654321', email: 'john@example.com', address: '456 Elm Street, San Jose', repairs: 2 },
  { id: '2', name: 'Jane Smith', phone: '+1555123456', email: 'jane@example.com', address: '789 Oak Lane, Cupertino', repairs: 1 },
  { id: '3', name: 'Mike Johnson', phone: '+1222444555', email: 'mike@example.com', address: '123 Pine Road, Sunnyvale', repairs: 3 },
];

export default function Customers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Customers</h2>
          <p className="text-muted-foreground text-sm">Manage shop clients and communication details.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Customer</span>
        </Button>
      </div>

      <div className="grid gap-4">
        {mockCustomers.map((cust) => (
          <Card key={cust.id}>
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-white">{cust.name}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {cust.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {cust.email}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {cust.address}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center bg-secondary/35 border border-border/60 rounded-xl px-4 py-2">
                  <span className="block text-xl font-bold text-white leading-none">{cust.repairs}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1 block">Tickets</span>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
