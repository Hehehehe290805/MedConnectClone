import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StarIcon, Trash2Icon } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const Stars = ({ value, size = "sm" }) => {
    const sz = size === "lg" ? "w-6 h-6" : "w-4 h-4";
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon
                    key={n}
                    className={`${sz} ${n <= Math.round(value) ? "text-yellow-400 fill-yellow-400" : "text-base-content/20"}`}
                />
            ))}
        </div>
    );
};

const DistributionBar = ({ count, total, star }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right opacity-60">{star}</span>
            <StarIcon className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />
            <div className="flex-1 bg-base-300 rounded-full h-2 overflow-hidden">
                <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right opacity-60">{count}</span>
        </div>
    );
};

const ReviewsSection = ({ providerId, isOwner = false }) => {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["providerReviews", providerId],
        queryFn: () => axiosInstance.get(`/booking/reviews/${providerId}`).then(r => r.data?.data),
        enabled: Boolean(providerId),
        staleTime: 2 * 60 * 1000,
    });

    const { mutate: deleteReview, isPending: isDeleting } = useMutation({
        mutationFn: (appointmentId) => axiosInstance.delete(`/booking/review/${appointmentId}`),
        onSuccess: () => {
            toast.success("Review removed.");
            queryClient.invalidateQueries({ queryKey: ["providerReviews", providerId] });
        },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to remove review."),
    });

    if (isLoading) {
        return (
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body flex justify-center py-8">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            </div>
        );
    }

    const { averageRating, reviewCount, distribution, reviews } = data ?? {
        averageRating: null, reviewCount: 0, distribution: {}, reviews: []
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-2xl mb-4">
                    <StarIcon className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                    Reviews
                </h2>

                {reviewCount === 0 ? (
                    <p className="text-sm opacity-50">No reviews yet.</p>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="flex flex-col sm:flex-row gap-6 mb-6">
                            {/* Average */}
                            <div className="flex flex-col items-center justify-center bg-base-100 rounded-xl p-5 min-w-[120px]">
                                <span className="text-5xl font-bold text-primary">{averageRating?.toFixed(1)}</span>
                                <Stars value={averageRating} size="sm" />
                                <p className="text-xs opacity-60 mt-1">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</p>
                            </div>

                            {/* Distribution */}
                            <div className="flex-1 space-y-1.5 justify-center flex flex-col">
                                {[5, 4, 3, 2, 1].map((star) => (
                                    <DistributionBar
                                        key={star}
                                        star={star}
                                        count={distribution?.[star] ?? 0}
                                        total={reviewCount}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Individual reviews */}
                        <div className="space-y-4">
                            {reviews.map((r, i) => (
                                <div key={r._id || i} className="bg-base-100 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                {r.patientName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-sm">{r.patientName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Stars value={r.rating} size="sm" />
                                            <span className="text-xs opacity-50">
                                                {dayjs(r.date).tz(PH_TZ).format("MMM D, YYYY")}
                                            </span>
                                            {isOwner && r._id && (
                                                <button
                                                    className="btn btn-ghost btn-xs text-error"
                                                    disabled={isDeleting}
                                                    onClick={() => deleteReview(r._id)}
                                                    title="Remove this review"
                                                >
                                                    <Trash2Icon className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {r.review && (
                                        <p className="text-sm opacity-80 leading-relaxed">{r.review}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReviewsSection;
