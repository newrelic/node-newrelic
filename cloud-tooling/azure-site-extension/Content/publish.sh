# This is just a simple shell script that will later be
# used as a template for a GHA job for
# azure site extension uploads.

# Dependencies: .Net 5 and up or .Net Core, Mono, and the Nuget CLI.
NUGET_API_KEY=$1
NUGET_SOURCE=$2
VERSION=$(cat version.txt)
NUSPEC_GENERATED="NewRelic.Azure.WebSites.Extension.NodeAgent.${VERSION}.nuspec"
sed "s/{VERSION}/${VERSION}/g" NewRelic.Azure.WebSites.Extension.NodeAgent.nuspec > "${NUSPEC_GENERATED}"
nuget pack "${NUSPEC_GENERATED}"
dotnet nuget push "NewRelic.Azure.WebSites.Extension.NodeAgent.${VERSION}.nupkg" --api-key ${NUGET_API_KEY} --source ${NUGET_SOURCE}