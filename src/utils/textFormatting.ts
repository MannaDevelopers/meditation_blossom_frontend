export const processTitleText = (title: string | undefined): string => {
  if (!title) return '';
  return title.replace(/\(/g, '\n(');
};
