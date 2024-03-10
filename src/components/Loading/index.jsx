import PropTypes from "prop-types";
import "./index.css";
const Loading = ({ show = false }) => {
  return (
    <>
      <div className={`loading-overlay ${show ? "show" : ""}`}>
        <div className="spinner"></div>
      </div>
    </>
  );
};
Loading.propTypes = {
  show: PropTypes.bool.isRequired,
};
export default Loading;
