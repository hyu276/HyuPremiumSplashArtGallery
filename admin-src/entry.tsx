import React from 'react';
import {createRoot} from 'react-dom/client';
import GitHubAdminDashboard from '../components/GitHubAdminDashboard';

const root=document.getElementById('root');
if(!root)throw new Error('Admin root element missing.');
createRoot(root).render(<GitHubAdminDashboard/>);
