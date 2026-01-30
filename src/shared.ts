export interface ContentItem {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  link?: string;
  type: 'project' | 'blog' | 'academic' | 'work';
  date?: string;
  fullContent?: string;
}