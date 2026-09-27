import { Navigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';

/**
 * Index is not routed (root uses CasinoDashboard directly).
 * Kept as a safe redirect in case it is ever mounted.
 */
const Index = () => {
  useSeoMeta({
    title: '0xPrivacy Casino — Decentralized Bitcoin Gaming',
    description: 'Privacy-first, censorship-resistant casino on Nostr.',
  });

  return <Navigate to="/" replace />;
};

export default Index;
