// A commit retry re-runs the transaction on a document Mongoose already treats as saved.
export function saveChanges(doc, changes, session) {
  doc.set(changes);
  Object.keys(changes).forEach((path) => doc.markModified(path));
  return doc.save({ session });
}
