import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signup, verifySignupCode, resendSignupCode } from "../lib/api";
import { useSignUpStore } from "../store/useSignUpStore";

const useSignUp = () => {
  const queryClient = useQueryClient();
  const { setEmail, setStep, setSignupMethod, setMockCode } = useSignUpStore();

  // step 1 — send verification code (email or phone)
  const { mutate: signupMutation, isPending: isSigningUp } = useMutation({
    mutationFn: signup,
    onSuccess: (data, variables) => {
      if (variables.phone) {
        setEmail(variables.phone);
        setSignupMethod("phone");
        setMockCode(data?.data?.mockCode ?? null);
      } else {
        setEmail(variables.email);
        setSignupMethod("email");
        setMockCode(null);
      }
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
  const { mutate: resendMutation, isPending: isResending } = useMutation({
    mutationFn: resendSignupCode,
  });

  return {
    signupMutation,
    isSigningUp,
    verifyMutation,
    isVerifying,
    resendMutation,
    isResending,
  };
};

export default useSignUp;