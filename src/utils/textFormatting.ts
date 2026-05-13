export const processTitleText = (title: string | undefined): string => {
  if (!title) return '';
  return title.replace(/^(\d+)\s+/, '$1\n').replace(/\(/g, '\n(');
};
