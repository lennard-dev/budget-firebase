import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="not-found" style={{ textAlign: 'center', padding: '50px' }}>
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <div style={{ marginTop: '20px' }}>
        <Link to="/">Go to Dashboard</Link>
        {' | '}
        <a href="/legacy/">Use Classic Version</a>
      </div>
    </div>
  );
};

export default NotFound;