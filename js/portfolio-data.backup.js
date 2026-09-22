/**
 * PORTFOLIO DATASET - MUSTAFA JAMAL
 * 3D Product Visualization & Modeling | E-Commerce, AR & Real-Time Assets
 */
const DEFAULT_PORTFOLIO_PROJECTS = [
  {
    "id": "test"
  }
];

// Check for custom projects stored locally by admin
function loadStoredProjects() {
  try {
    const keys = ['mustafa_portfolio_projects_v5', 'mustafa_portfolio_projects_v6'];
    for (const key of keys) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Could not load stored projects from localStorage:', e);
  }
  return DEFAULT_PORTFOLIO_PROJECTS;
}

let PORTFOLIO_PROJECTS = loadStoredProjects();

// Helper functions for Admin Panel
function savePortfolioProjects(projects) {
  try {
    localStorage.setItem('mustafa_portfolio_projects_v5', JSON.stringify(projects));
    localStorage.setItem('mustafa_portfolio_projects_v6', JSON.stringify(projects));
    PORTFOLIO_PROJECTS = projects;
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

function resetPortfolioProjects() {
  localStorage.removeItem('mustafa_portfolio_projects_v5');
  localStorage.removeItem('mustafa_portfolio_projects_v6');
  PORTFOLIO_PROJECTS = DEFAULT_PORTFOLIO_PROJECTS;
}

if (typeof window !== 'undefined') {
  window.DEFAULT_PORTFOLIO_PROJECTS = DEFAULT_PORTFOLIO_PROJECTS;
  window.PORTFOLIO_PROJECTS = PORTFOLIO_PROJECTS;
  window.savePortfolioProjects = savePortfolioProjects;
  window.resetPortfolioProjects = resetPortfolioProjects;
}

if (typeof module !== 'undefined') {
  module.exports = { DEFAULT_PORTFOLIO_PROJECTS, PORTFOLIO_PROJECTS, savePortfolioProjects, resetPortfolioProjects };
}
