import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall, disabled }) {
  return (
    <div className="p-3 border-b flex items-center justify-end max-w-7xl mx-auto w-full absolute top-0">
      <button
        onClick={handleVideoCall}
        disabled={disabled}
        className="btn btn-success btn-sm text-white disabled:opacity-40"
        title={disabled ? "Only available during an ongoing appointment" : "Join video call"}
      >
        <VideoIcon className="size-6" />
      </button>
    </div>
  );
}

export default CallButton;
