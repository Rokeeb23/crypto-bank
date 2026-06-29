import { HiCheckCircle, HiClock } from 'react-icons/hi';

export default function StatusBadge({ status }) {
  const icon = status === 'confirmed' ? <HiCheckCircle /> : <HiClock />;
  return <span className={`status-badge ${status}`}>{icon} {status}</span>;
}
