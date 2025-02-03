import { useToast } from "@/components/ui/use-toast";
import { PostsPage, User } from "@/lib/types";
import { useUploadThing } from "@/lib/uploadthing";
import { UpdateUserProfileValues } from "@/lib/validation";
import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "./actions";

export function useUpdateProfileMutation() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { startUpload: startAvatarUpload } = useUploadThing("avatar");

  const mutation = useMutation({
    mutationFn: async ({
      values,
      avatar,
    }: {
      values: UpdateUserProfileValues;
      avatar?: File;
    }) => {
      return Promise.all([
        updateUserProfile(values),
        avatar ? startAvatarUpload([avatar]) : Promise.resolve(undefined),
      ]);
    },
    onSuccess: async ([updatedUser, uploadResult]) => {
      if (!updatedUser) {
        toast({
          variant: "destructive",
          description: "Failed to update profile. Please try again.",
        });
        return;
      }

      const newAvatarUrl = uploadResult?.[0]?.serverData?.avatarUrl;

      const queryFilter: QueryFilters = {
        queryKey: ["post-feed"],
      };

      await queryClient.cancelQueries(queryFilter);

      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        queryFilter,
        (oldData) => {
          if (!oldData) return oldData; // Ensure oldData isn't undefined

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) =>
                post.user.id === updatedUser.id
                  ? {
                      ...post,
                      user: {
                        ...updatedUser,
                        avatarUrl: newAvatarUrl || updatedUser.avatarUrl,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );

      router.refresh();

      toast({
        description: "Profile updated successfully!",
      });
    },
    onError(error) {
      console.error("Profile update error:", error);
      toast({
        variant: "destructive",
        description: "Failed to update profile. Please try again.",
      });
    },
  });

  return mutation;
}
