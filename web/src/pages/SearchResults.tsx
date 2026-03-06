import { useLocation } from "react-router-dom";
import Home from "./Home";

function SearchResults() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const searchQueryValue = params.get("query");

  return <Home query={searchQueryValue || "1234567890"} />;
}

export default SearchResults;
