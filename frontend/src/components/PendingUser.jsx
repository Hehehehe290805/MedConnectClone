const PendingUser = ({ user, onViewDetails }) => {
    return (
        <div className="flex items-center justify-between p-4 border rounded shadow-sm bg-base-100 mb-2">
            <span className="font-mono text-sm">{user._id}</span>
            <button
                className="btn btn-sm btn-primary"
                onClick={() => onViewDetails(user)}
            >
                View Details
            </button>
        </div>
    );
};

export default PendingUser;
