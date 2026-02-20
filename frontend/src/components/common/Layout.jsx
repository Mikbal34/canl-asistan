import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <main className="pt-16">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
