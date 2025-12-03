import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  BookOpen, 
  Clock, 
  ExternalLink, 
  Search, 
  ArrowLeft,
  Calendar
} from "lucide-react";

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  content_type: string;
  source_url: string | null;
  source_name: string | null;
  source_author: string | null;
  reading_time_minutes: number | null;
  published_at: string | null;
}

// Article List View
function ArticleList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    const { data, error } = await supabase
      .from('academy_articles')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (!error && data) {
      setArticles(data);
    }
    setLoading(false);
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getContentTypeBadge = (type: string) => {
    switch (type) {
      case 'original':
        return <Badge className="bg-primary">Momentum Academy</Badge>;
      case 'curated':
        return <Badge variant="secondary">Curated</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Momentum Academy</h1>
          </div>
          <p className="text-muted-foreground">
            Leadership insights and professional development resources from The Momentum Company
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="container mx-auto px-4 py-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search articles..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Articles Grid */}
      <main className="container mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading articles...</div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No articles found</h3>
            <p className="text-muted-foreground">Check back soon for new content</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <Link to={`/academy/${article.slug}`} key={article.id}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      {getContentTypeBadge(article.content_type)}
                      {article.reading_time_minutes && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {article.reading_time_minutes} min
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                    {article.summary && (
                      <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                        {article.summary}
                      </p>
                    )}
                    {article.published_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(article.published_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                    {article.source_name && article.content_type === 'curated' && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Originally from {article.source_name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} The Momentum Company. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Single Article View
function ArticleView() {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchArticle();
    }
  }, [slug]);

  const fetchArticle = async () => {
    const { data, error } = await supabase
      .from('academy_articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (!error && data) {
      setArticle(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <Link to="/academy">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Academy
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link to="/academy" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Momentum Academy
          </Link>
        </div>
      </header>

      {/* Article */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <article>
          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            {article.content_type === 'original' ? (
              <Badge className="bg-primary">Momentum Academy</Badge>
            ) : (
              <Badge variant="secondary">Curated</Badge>
            )}
            {article.reading_time_minutes && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {article.reading_time_minutes} min read
              </span>
            )}
            {article.published_at && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(article.published_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

          {/* Summary */}
          {article.summary && (
            <p className="text-xl text-muted-foreground mb-6">{article.summary}</p>
          )}

          {/* Attribution for curated content */}
          {article.content_type === 'curated' && article.source_name && (
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm">
                <span className="font-medium">Curated from: </span>
                {article.source_name}
                {article.source_author && ` by ${article.source_author}`}
              </p>
              {article.source_url && (
                <a 
                  href={article.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Read original article
                </a>
              )}
            </div>
          )}

          <Separator className="my-6" />

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {article.content?.split('\n').map((paragraph, i) => {
              if (paragraph.startsWith('# ')) {
                return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{paragraph.slice(2)}</h1>;
              }
              if (paragraph.startsWith('## ')) {
                return <h2 key={i} className="text-2xl font-semibold mt-6 mb-3">{paragraph.slice(3)}</h2>;
              }
              if (paragraph.startsWith('### ')) {
                return <h3 key={i} className="text-xl font-medium mt-4 mb-2">{paragraph.slice(4)}</h3>;
              }
              if (paragraph.startsWith('- ')) {
                return <li key={i} className="ml-4">{paragraph.slice(2)}</li>;
              }
              if (paragraph.trim() === '') {
                return <br key={i} />;
              }
              return <p key={i} className="mb-4 leading-relaxed">{paragraph}</p>;
            })}
          </div>

          {/* Source link for curated */}
          {article.content_type === 'curated' && article.source_url && (
            <div className="mt-8 pt-6 border-t">
              <a 
                href={article.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Continue reading at {article.source_name || 'source'}
              </a>
            </div>
          )}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} The Momentum Company. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Main component that routes based on slug param
export default function AcademyBlog() {
  const { slug } = useParams();
  
  if (slug) {
    return <ArticleView />;
  }
  
  return <ArticleList />;
}
