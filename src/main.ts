import './ui/style.css';
import { App } from './ui/app.ts';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app missing');
const app = new App(root);
app.showMenu();
// Exposed for Playwright smoke tests and debugging in the console.
(window as unknown as { outlierSim: App }).outlierSim = app;
