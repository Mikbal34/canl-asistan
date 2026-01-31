import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * Main layout component with sidebar and header
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 */
export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50">
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
