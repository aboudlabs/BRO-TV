import type { Metadata } from 'next';
import RoomClient from '@/components/RoomClient';

export const metadata: Metadata = {
  title: 'غرفة مشاهدة',
};

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const roomId = decodeURIComponent(params.roomId).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  return <RoomClient roomId={roomId || 'BRO-LOBBY'} />;
}
