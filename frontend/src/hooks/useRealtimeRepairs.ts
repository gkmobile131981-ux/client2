import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function useRealtimeRepairs(onNewAssignment?: (repairId: string) => void) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user || !user.shop_id) return;

    const shopId = user.shop_id;
    const userId = user.id;

    // Subscribe to Postgres changes on 'repairs' table filtering by current shop_id
    const channel = supabase
      .channel(`realtime:repairs:${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `shop_id=eq.${shopId}`
        },
        async (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload as any;

          if (eventType === 'INSERT') {
            // 1. Invalidate lists to trigger a background reload with nested models
            queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
            
            // 2. Notify owner of new intakes
            if (user.role === 'owner') {
              toast.success(`New repair order received: ${newRecord.job_number || 'GK-Repair'}`);
            }
          }

          if (eventType === 'UPDATE') {
            // 1. Check if newly assigned to current staff member
            if (
              user.role === 'staff' && 
              newRecord.staff_id === userId && 
              oldRecord.staff_id !== userId
            ) {
              toast.success(`You have been assigned a new repair order: ${newRecord.job_number}`, {
                duration: 6000
              });
              if (onNewAssignment) {
                onNewAssignment(newRecord.id);
              }
            }

            // 2. Update all queries in query cache matching 'repairs-list'
            const queryCache = queryClient.getQueryCache();
            const queries = queryCache.findAll({ queryKey: ['repairs-list'] });
            
            queries.forEach((query) => {
              queryClient.setQueryData(query.queryKey, (oldData: any) => {
                if (!oldData || !oldData.repairs) return oldData;
                
                const index = oldData.repairs.findIndex((r: any) => r.id === newRecord.id);
                if (index === -1) return oldData; // not in this filtered list segment
                
                const updatedList = [...oldData.repairs];
                updatedList[index] = {
                  ...updatedList[index],
                  ...newRecord,
                  balance: Number(newRecord.estimate ?? updatedList[index].estimate) - 
                           Number(newRecord.advance ?? updatedList[index].advance)
                };
                
                return {
                  ...oldData,
                  repairs: updatedList
                };
              });
            });

            // 3. Invalidate single details and main lists to fetch updated joined data
            queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
            queryClient.invalidateQueries({ queryKey: ['repair-detail', newRecord.id] });
          }

          if (eventType === 'DELETE') {
            const queryCache = queryClient.getQueryCache();
            const queries = queryCache.findAll({ queryKey: ['repairs-list'] });
            
            queries.forEach((query) => {
              queryClient.setQueryData(query.queryKey, (oldData: any) => {
                if (!oldData || !oldData.repairs) return oldData;
                return {
                  ...oldData,
                  repairs: oldData.repairs.filter((r: any) => r.id !== oldRecord.id)
                };
              });
            });

            queryClient.invalidateQueries({ queryKey: ['repairs-list'] });
            queryClient.invalidateQueries({ queryKey: ['repair-detail', oldRecord.id] });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient, onNewAssignment]);

  return { isConnected };
}
