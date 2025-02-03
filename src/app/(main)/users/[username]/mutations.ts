import { useToast } from "@/components/ui/use-toast";
import { PostsPage } from "@/lib/types";
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
      // Update the user profile
      const updatedUser = await updateUserProfile(values);

      // Upload the avatar if provided
      const uploadResult = avatar ? await startAvatarUpload([avatar]) : undefined;

      // Return both the updated user and the upload result
      return { updatedUser, uploadResult };
    },
    onSuccess: async ({ updatedUser, uploadResult }) => {
      if (!updatedUser) {
        toast({
          variant: "destructive",
          description: "Failed to update profile. Please try again.",
        });
        return;
      }

      // Get the new avatar URL if the upload was successful
      const newAvatarUrl = uploadResult?.[0]?.url ?? updatedUser.avatarUrl;

      // Define the query key
      const queryKey = ["post-feed"];

      // Cancel any ongoing queries for the post feed
      await queryClient.cancelQueries({ queryKey });

      // Update the cached post feed data with the new user profile information
      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        { queryKey } as QueryFilters<InfiniteData<PostsPage, string | null>, Error>,
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) =>
                post.user.id === updatedUser.id
                  ? {
                      ...post,
                      user: {
                        ...post.user,
                        avatarUrl: newAvatarUrl,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );

      // Refresh the page to reflect the changes
      router.refresh();

      // Show a success toast
      toast({
        description: "Profile updated successfully!",
      });
    },
    onError: (error) => {
      console.error("Profile update error:", error);
      toast({
        variant: "destructive",
        description: "Failed to update profile. Please try again.",
      });
    },
  });

  return mutation;
}
