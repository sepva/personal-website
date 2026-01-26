export interface ContentItem {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  link_to_article?: string;
  type: 'project' | 'blog' | 'academic' | 'work';
  date?: string;
  fullContent?: string;
}