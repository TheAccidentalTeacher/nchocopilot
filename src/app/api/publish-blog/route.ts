// API route: POST /api/publish-blog — creates a blog article in Shopify
// Requires write_content scope

import { NextResponse } from "next/server";
import { gql } from "@/lib/shopify";
import { fetchBlogs } from "@/lib/shopify-queries";

export async function POST(request: Request) {
  try {
    const { title, body, excerpt, seoTitle, seoDescription, tags } =
      await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    // Get the first blog (Shopify stores typically have a "News" blog)
    const blogs = await fetchBlogs();
    if (blogs.length === 0) {
      return NextResponse.json(
        { error: "No blog found in Shopify store. Create one in Shopify admin first." },
        { status: 400 }
      );
    }
    const blogId = blogs[0].id;

    const data = await gql<{
      articleCreate: {
        article: {
          id: string;
          title: string;
          handle: string;
        } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(
      `mutation articleCreate($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article {
            id
            title
            handle
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        article: {
          blogId,
          title,
          body,
          summary: excerpt || undefined,
          tags: tags || [],
          seo: {
            title: seoTitle || title,
            description: seoDescription || excerpt || "",
          },
          isPublished: true,
          author: {
            name: "Next Chapter Homeschool Outpost",
          },
        },
      }
    );

    if (data.articleCreate.userErrors.length > 0) {
      return NextResponse.json(
        { error: data.articleCreate.userErrors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      article: data.articleCreate.article,
    });
  } catch (error) {
    console.error("Blog publish error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to publish blog post",
      },
      { status: 500 }
    );
  }
}
