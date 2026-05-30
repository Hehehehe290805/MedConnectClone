import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signup, verifySignupCode, resendSignupCode } from "../lib/api";
import { useSignupStore } from "../store/useSignupStore";

const useSignUp = () => {
  const queryClient = useQueryClient();
  const { setEmail, setStep } = useSignupStore();

  // step 1 — send verification code
  const { mutate: signupMutation, isPending: isSigningUp, error: signupError } = useMutation({
    mutationFn: signup,
    onSuccess: (_, variables) => {
      setEmail(variables.email);
      setStep("verify");
    },
  });

  // step 2 — verify code, creates account
  const { mutate: verifyMutation, isPending: isVerifying, error: verifyError } = useMutation({
    mutationFn: verifySignupCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
  });

  // resend code
  const { mutate: resendMutation, isPending: isResending, error: resendError } = useMutation({
    mutationFn: resendSignupCode,
  });

  return {
    signupMutation,
    isSigningUp,
    signupError,
    verifyMutation,
    isVerifying,
    verifyError,
    resendMutation,
    isResending,
    resendError,
  };
};

export default useSignUp;